use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct GridProps {
    pub header: Vec<String>,
    pub data: Vec<Vec<String>>,
}

#[function_component(Grid)]
pub fn grid(props: &GridProps) -> Html {
    html! {
        <div class="relative scroll-smooth hover:scroll-auto overflow-x-auto shadow-md border dark:border-zinc-200 border-zinc-400 rounded-lg">
            <div class="flex items-center justify-between pb-4">
                <table class="w-full text-sm text-left text-zinc-400 dark:text-zinc-200 table-auto bg-white dark:bg-zinc-700 bg-opacity-30 dark:bg-opacity-30">
                    <thead class="text-xs uppercase dark:bg-zinc-500 dark:text-zinc-200 text-zinc-400 bg-opacity-30 dark:bg-opacity-30">
                        <tr>
                            {for props.header.iter().map(|hd| html! {
                                <th scope="col" class="px-3 py-3">
                                    <div class="text-sm font-normal">{ hd }</div>
                                </th>
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {for props.data.iter().map(|row|
                            html! {
                                <tr class="bg-white bg-opacity-40 dark:bg-opacity-40 dark:bg-zinc-800 dark:border-zinc-700 border-b hover:bg-zinc-50 dark:hover:bg-zinc-600">
                                    {for row.iter().enumerate().map(|(idx, cell)|
                                        if idx == 0 {
                                            html! {
                                                <th scope="row" class="flex items-center px-3 py-4 text-zinc-400 whitespace-nowrap dark:text-zinc-300">
                                                    <div class="text-sm font-normal">{ cell }</div>
                                                </th>
                                            }
                                        } else {
                                            html! { <td class="px-3 py-4">{ cell }</td> }
                                        }
                                    )}
                                </tr>
                            }
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    }
}
